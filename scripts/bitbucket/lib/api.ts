#!/usr/bin/env bun
import { loadConfig, type BitbucketConfig } from './config';
import type {
  BitbucketPaginatedResponse,
  BitbucketError,
  BitbucketPullRequest,
  BitbucketPullRequestCreate,
  BitbucketPullRequestUpdate,
  BitbucketRepository,
} from './types';

export class BitbucketAPI {
  private config: BitbucketConfig;
  private baseUrl = 'https://api.bitbucket.org/2.0';
  private authHeader: string;
  private maxRetries = 3;
  private retryDelay = 1000; // Start with 1 second

  constructor(config?: BitbucketConfig) {
    this.config = config || loadConfig();
    this.authHeader = `Basic ${Buffer.from(`${this.config.username}:${this.config.appPassword}`).toString('base64')}`;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    retryCount = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseText = await response.text();
      let responseData: any;
      
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${responseText}`);
        }
        responseData = {};
      }

      // Handle rate limiting and server errors with retry
      if (response.status === 429 || response.status === 503) {
        if (retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount); // Exponential backoff
          console.log(`⏳ Rate limited or server unavailable. Retrying in ${delay}ms...`);
          await this.sleep(delay);
          return this.request<T>(method, path, body, retryCount + 1);
        }
      }

      if (!response.ok) {
        const error = responseData as BitbucketError;
        let errorMessage = `HTTP ${response.status}: `;
        
        if (error.error?.message) {
          errorMessage += error.error.message;
          if (error.error.fields) {
            errorMessage += '\nField errors:';
            for (const [field, errors] of Object.entries(error.error.fields)) {
              errorMessage += `\n  - ${field}: ${errors.join(', ')}`;
            }
          }
        } else {
          errorMessage += JSON.stringify(responseData);
        }
        
        throw new Error(errorMessage);
      }

      return responseData as T;
    } catch (error) {
      // Network errors and other fetch failures
      if (retryCount < this.maxRetries && error instanceof Error) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
          const delay = this.retryDelay * Math.pow(2, retryCount);
          console.log(`⏳ Network error. Retrying in ${delay}ms...`);
          await this.sleep(delay);
          return this.request<T>(method, path, body, retryCount + 1);
        }
      }
      throw error;
    }
  }

  async createPullRequest(
    workspace: string,
    repoSlug: string,
    data: BitbucketPullRequestCreate
  ): Promise<BitbucketPullRequest> {
    return this.request<BitbucketPullRequest>(
      'POST',
      `/repositories/${workspace}/${repoSlug}/pullrequests`,
      data
    );
  }

  async updatePullRequest(
    workspace: string,
    repoSlug: string,
    prId: number,
    data: BitbucketPullRequestUpdate
  ): Promise<BitbucketPullRequest> {
    return this.request<BitbucketPullRequest>(
      'PUT',
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`,
      data
    );
  }

  async getPullRequest(
    workspace: string,
    repoSlug: string,
    prId: number
  ): Promise<BitbucketPullRequest> {
    return this.request<BitbucketPullRequest>(
      'GET',
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`
    );
  }

  async listPullRequests(
    workspace: string,
    repoSlug: string,
    state?: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED'
  ): Promise<BitbucketPaginatedResponse<BitbucketPullRequest>> {
    let path = `/repositories/${workspace}/${repoSlug}/pullrequests`;
    if (state) {
      path += `?state=${state}`;
    }
    return this.request<BitbucketPaginatedResponse<BitbucketPullRequest>>(
      'GET',
      path
    );
  }

  async listRepositories(
    workspace: string,
    query?: string
  ): Promise<BitbucketPaginatedResponse<BitbucketRepository>> {
    let path = `/repositories/${workspace}`;
    if (query) {
      path += `?q=name~"${query}"`;
    }
    return this.request<BitbucketPaginatedResponse<BitbucketRepository>>(
      'GET',
      path
    );
  }

  async getRepository(
    workspace: string,
    repoSlug: string
  ): Promise<BitbucketRepository> {
    return this.request<BitbucketRepository>(
      'GET',
      `/repositories/${workspace}/${repoSlug}`
    );
  }

  async getBranches(
    workspace: string,
    repoSlug: string
  ): Promise<BitbucketPaginatedResponse<any>> {
    return this.request<BitbucketPaginatedResponse<any>>(
      'GET',
      `/repositories/${workspace}/${repoSlug}/refs/branches`
    );
  }

  async getAllBranches(
    workspace: string,
    repoSlug: string
  ): Promise<any[]> {
    const branches = [];
    const firstPage = await this.getBranches(workspace, repoSlug);
    branches.push(...firstPage.values);
    
    if (firstPage.next) {
      for await (const branch of this.getAllPages<any>(firstPage.next)) {
        branches.push(branch);
      }
    }
    
    return branches;
  }

  async *getAllPages<T>(
    initialUrl: string
  ): AsyncGenerator<T, void, unknown> {
    let url: string | undefined = initialUrl;
    
    while (url) {
      const response = await this.request<BitbucketPaginatedResponse<T>>(
        'GET',
        url.replace(this.baseUrl, '')
      );
      
      for (const item of response.values) {
        yield item;
      }
      
      url = response.next;
    }
  }
}