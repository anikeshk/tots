// The only place that reads GITHUB_TOKEN. Runs in the app runtime, never in a sandbox.
// Swapping to Vercel Connect later only changes this file.

export async function github<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub ${path} returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

export interface GitHubComment {
  user: { login: string } | null;
  author_association: string;
  created_at: string;
  html_url: string;
  body: string | null;
}

export interface GitHubIssue extends GitHubComment {
  title: string;
  state: string;
  locked: boolean;
  pull_request?: unknown;
  comments: number;
}

export interface GitHubAdvisory {
  ghsa_id: string;
  html_url: string;
  severity: string;
  summary: string;
  withdrawn_at: string | null;
  references: string[];
  vulnerabilities: {
    package: { ecosystem: string; name: string };
    vulnerable_version_range: string | null;
    first_patched_version: string | null;
  }[];
}
