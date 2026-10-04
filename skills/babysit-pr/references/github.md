# GitHub evidence and operations

Use this reference during a live babysitting cycle. The examples assume the
canonical target has already been resolved. Set `pr_url`, `repo` (`OWNER/REPO`),
`number`, `owner`, and `name` from that target, never from an unrelated checkout.
For GitHub Enterprise, route `gh api` with `--hostname` and use the matching
authenticated host. Validate the installed CLI's help before using a flag.

## Collect the complete picture

```bash
gh pr view "$pr_url" --json url,number,state,isDraft,headRefOid,headRefName,headRepository,headRepositoryOwner,baseRefName,baseRefOid,mergeable,mergeStateStatus,reviewDecision,reviewRequests,statusCheckRollup
gh pr checks "$pr_url" --json name,state,bucket,workflow,link
gh api --paginate "repos/$repo/issues/$number/comments?per_page=100"
gh api --paginate "repos/$repo/pulls/$number/reviews?per_page=100"
gh api --paginate "repos/$repo/pulls/$number/comments?per_page=100"
```

Treat collections embedded in `gh pr view` as summaries, not proof of
complete pagination. For example, enumerate requested reviewers separately
with a GraphQL `reviewRequests(first:100,after:$endCursor)` connection,
`pageInfo { hasNextPage endCursor }`, and
`nodes { requestedReviewer { __typename ... on User { login } ... on Team { slug } ... on Bot { login } } }`.
Use the same `gh api graphql --paginate` pattern below and resolve every page.
Use the dedicated checks command for the complete check inventory rather than
depending on the summarized `statusCheckRollup` alone.

Keep full comment/review bodies for triage. Reviews carry `commit_id`; inline
comments carry commit/location and reply ancestry. Inspect checks for the
current head and, where applicable, GitHub's test-merge revision; verify their
association with this PR/revision rather than treating an unrelated run as
evidence. Follow links to check output and workflow logs when diagnosis or bot
completion is unclear. Avoid exposing secrets in logs.

`gh pr checks --required` is useful for the protected-branch subset, but cannot
replace the full inventory: optional bot checks may matter to the user's gate.
Check exit code 8 means pending, not a tool failure or success. Distinguish an
empty check collection from successful checks. A `pass` bucket does not prove
there are no review findings. Inspect native states and conclusions too.

Fetch thread state separately. This query paginates the outer connection and
collects the root comment ID; join it with the full paginated inline comments
above, following `in_reply_to_id` for complete discussions. It intentionally
does not rely on a truncated nested comment collection for triage.

```bash
gh api graphql --paginate \
  -f owner="$owner" -f name="$name" -F number="$number" \
  -f query='query($owner:String!,$name:String!,$number:Int!,$endCursor:String) {
    repository(owner:$owner,name:$name) {
      pullRequest(number:$number) {
        reviewThreads(first:100,after:$endCursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id isResolved isOutdated path line
            comments(first:1) { nodes { databaseId url } }
          }
        }
      }
    }
  }'
```

Verify all pages were read and reject GraphQL errors, missing repositories,
null PRs, or unjoinable discussions as incomplete evidence. If the connector
already exposes full paginated threads, use that equivalent surface.
Do not infer completeness from an empty partial result.

## Determine bot completion

For each expected bot, record its identity, completion signal, reviewed SHA,
current outcome, and findings. A bot may use a check run, formal review,
editable summary comment, or several of these. Read updated comments as well
as newly created ones. Use the provider's actual documented contract; some
bots never submit `APPROVED`. A completed review with no valid outstanding
findings can satisfy the bot gate without that literal state. It cannot
override a failing required check or a required GitHub approval.

When a new commit starts a new cycle, old reviews and resolved threads remain
historical evidence. They do not prove the new cycle completed. If the bot is
missing, stuck, skipped, or unable to run, report that condition. Do not invent
a universal delay after which silence means approval.

## Reply and resolve

Use ordinary review-thread replies for inline findings. Use a JSON body file
to preserve multiline text without shell interpolation. This operation uses
the numeric root review-comment ID, not the GraphQL thread ID:

```bash
gh api --method POST "repos/$repo/pulls/$number/comments/$comment_id/replies" \
  --input "$reply_json_file"
```

The JSON object is `{"body":"Fixed in <commit>; <change and validation>."}`.
For findings in issue comments or a top-level review body, use an appropriate
PR comment referencing the original source URL; do not call the inline reply
endpoint with an issue-comment or review ID. Use `gh pr comment --body-file`
or an equivalent structured connector. Check for an existing equivalent reply
before posting, especially after a lost response.

Once the published fix or counter-evidence justifies closure and the main
workflow permits it, resolve with the GraphQL thread ID:

```bash
gh api graphql -f threadId="$thread_id" \
  -f query='mutation($threadId:ID!) {
    resolveReviewThread(input:{threadId:$threadId}) {
      thread { id isResolved }
    }
  }'
```

Verify the returned state. Do not resolve merely to satisfy a thread-count
gate, or substitute thread resolution for a required reviewer's acceptance.

## Final evidence

Refresh the entire snapshot before reporting green, and compare the remote
head/base before and after the sweep. Re-read any updated discussion and
reconcile new runs. A native watcher notification is a prompt to do this
inspection, not a cached green verdict.

References: [check command](https://cli.github.com/manual/gh_pr_checks),
[API pagination](https://cli.github.com/manual/gh_api), and
[merge behavior](https://cli.github.com/manual/gh_pr_merge).
