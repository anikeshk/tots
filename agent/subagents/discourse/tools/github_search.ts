import { defineTool } from "eve/tools";
import { z } from "zod";
import { github } from "../../../lib/github";

export default defineTool({
  description:
    "Search GitHub issues and pull requests, e.g. `CVE-2024-1234 repo:owner/name` (issues by default; add `is:pr` for pull requests). Returns titles, URLs, and comment counts.",
  inputSchema: z.object({ query: z.string().min(3).max(256) }),
  async execute({ query }) {
    // GitHub's issue search requires an explicit type qualifier.
    const q = /\bis:(issue|pr|pull-request)\b/.test(query) ? query : `${query} is:issue`;
    const result = await github<{
      total_count: number;
      items: { title: string; html_url: string; state: string; comments: number; repository_url: string }[];
    }>(`/search/issues?q=${encodeURIComponent(q)}&per_page=15`);
    return {
      total: result.total_count,
      items: result.items.map((item) => ({
        title: item.title,
        url: item.html_url,
        state: item.state,
        comments: item.comments,
        repo: item.repository_url.replace("https://api.github.com/repos/", ""),
      })),
    };
  },
});
