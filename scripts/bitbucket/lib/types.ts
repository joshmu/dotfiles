// Bitbucket API v2.0 Types

export interface BitbucketUser {
  uuid: string;
  username: string;
  display_name: string;
  type: string;
  links: {
    self: { href: string };
    html: { href: string };
    avatar: { href: string };
  };
}

export interface BitbucketBranch {
  name: string;
  target: {
    hash: string;
    date: string;
    author: {
      user?: BitbucketUser;
      raw: string;
    };
    message: string;
  };
}

export interface BitbucketRepository {
  uuid: string;
  name: string;
  slug: string;
  full_name: string;
  description?: string;
  is_private: boolean;
  fork_policy: string;
  language: string;
  created_on: string;
  updated_on: string;
  size: number;
  has_issues: boolean;
  has_wiki: boolean;
  mainbranch?: {
    name: string;
    type: string;
  };
  links: {
    self: { href: string };
    html: { href: string };
    clone: Array<{ name: string; href: string }>;
  };
  owner: BitbucketUser;
  workspace: {
    slug: string;
    name: string;
    uuid: string;
    links: {
      self: { href: string };
      html: { href: string };
    };
  };
}

export interface BitbucketPullRequest {
  id: number;
  title: string;
  description?: string;
  state: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';
  author: BitbucketUser;
  source: {
    branch: BitbucketBranch;
    repository: BitbucketRepository;
  };
  destination: {
    branch: BitbucketBranch;
    repository: BitbucketRepository;
  };
  merge_commit?: {
    hash: string;
  };
  participants: Array<{
    user: BitbucketUser;
    role: 'PARTICIPANT' | 'REVIEWER';
    approved: boolean;
    state: string;
  }>;
  reviewers: BitbucketUser[];
  close_source_branch: boolean;
  closed_by?: BitbucketUser;
  created_on: string;
  updated_on: string;
  links: {
    self: { href: string };
    html: { href: string };
    commits: { href: string };
    approve: { href: string };
    diff: { href: string };
    activity: { href: string };
  };
}

export interface BitbucketPullRequestCreate {
  title: string;
  description?: string;
  source: {
    branch: {
      name: string;
    };
  };
  destination?: {
    branch: {
      name: string;
    };
  };
  close_source_branch?: boolean;
  reviewers?: Array<{ uuid: string }>;
}

export interface BitbucketPullRequestUpdate {
  title?: string;
  description?: string;
  destination?: {
    branch: {
      name: string;
    };
  };
  reviewers?: Array<{ uuid: string }>;
}

export interface BitbucketPaginatedResponse<T> {
  values: T[];
  pagelen: number;
  size?: number;
  page?: number;
  next?: string;
  previous?: string;
}

export interface BitbucketError {
  type: string;
  error: {
    message: string;
    fields?: Record<string, string[]>;
  };
}

export interface BitbucketWorkspace {
  uuid: string;
  name: string;
  slug: string;
  is_private: boolean;
  type: string;
  links: {
    self: { href: string };
    html: { href: string };
    avatar: { href: string };
  };
}