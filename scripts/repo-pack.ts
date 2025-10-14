#!/usr/bin/env bun

interface ScriptOutput {
  success: boolean;
  url?: string;
  content?: string;
  error?: string;
}

async function fetchRepoContext(url: string): Promise<string> {
  const formData = new FormData();
  formData.append('url', url);
  formData.append('format', 'xml');
  formData.append('options', JSON.stringify({
    removeComments: false,
    removeEmptyLines: false,
    showLineNumbers: false,
    fileSummary: true,
    directoryStructure: true,
    outputParsable: false,
    compress: false
  }));

  const response = await fetch('https://api.repomix.com/api/pack', {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'origin': 'https://repomix.com',
      'referer': 'https://repomix.com/',
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`API returned status ${response.status}`);
  }

  return await response.text();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    const output: ScriptOutput = {
      success: false,
      error: "Please provide a GitHub URL as an argument"
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }

  const url = args[0];

  // Basic GitHub URL validation
  if (!url.includes('github.com')) {
    const output: ScriptOutput = {
      success: false,
      error: `Not a GitHub URL: ${url}`,
      url
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }

  try {
    const content = await fetchRepoContext(url);

    const output: ScriptOutput = {
      success: true,
      url,
      content
    };

    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    const output: ScriptOutput = {
      success: false,
      error: error.message,
      url
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }
}

main();
