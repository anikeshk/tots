import { defineTool } from "eve/tools";
import { z } from "zod";
import { github, type GitHubComment, type GitHubIssue } from "../../../lib/github";

const MAX_COMMENTS = 60;
const MAX_BODY = 1200;

const toComment = (c: GitHubComment) => ({
  author: c.user?.login ?? "ghost",
  // GitHub's own role marker: OWNER, MEMBER, COLLABORATOR, CONTRIBUTOR, NONE, ...
  authorAssociation: c.author_association,
  createdAt: c.created_at,
  url: c.html_url,
  body: (c.body ?? "").slice(0, MAX_BODY),
});

export default defineTool({
  description:
    "Read a GitHub issue or pull request with its comments. Each comment includes GitHub's authorAssociation (OWNER/MEMBER/COLLABORATOR mean project maintainers).",
  inputSchema: z.object({
    owner: z.string(),
    repo: z.string(),
    number: z.number().int().positive(),
  }),
  async execute({ owner, repo, number }) {
    const issue = await github<GitHubIssue>(`/repos/${owner}/${repo}/issues/${number}`);
    const comments = await github<GitHubComment[]>(
      `/repos/${owner}/${repo}/issues/${number}/comments?per_page=${MAX_COMMENTS}`,
    );
    return {
      title: issue.title,
      kind: issue.pull_request ? "pull_request" : "issue",
      state: issue.state,
      locked: issue.locked,
      totalComments: issue.comments,
      opening: toComment(issue),
      comments: comments.map(toComment),
    };
  },
});
