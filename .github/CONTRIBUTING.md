# Contributing Guidelines 
## Branching
You always create a branch from an existing branch. Typically, you might create a new branch from the default branch of your repository. You can then work on this new branch in isolation from changes that other people are making to the repository.

Once you're satisfied with your work, you can open a pull request to merge the changes in the current branch (the head branch) into another branch (the base branch). After a pull request has been merged, or closed, the head branch can be deleted as it is no longer needed.

## Pull Requests

If your pull request consists of changes to multiple files, provide guidance to reviewers about the order in which to review the files. Recommend where to start and how to proceed with the review.
Once you've created a pull request, you can push commits from your topic branch to add them to your existing pull request. These commits will appear in chronological order within your pull request.

Other contributors can review your proposed changes, add review comments, and participate in the pull request discussion. Currently, for a pull request to be merged, it requires at least two approving reviews from the assigned reviewers. Repository admins will assign reviewers for each pull request.

Once the reviewers are satisfied with the proposed changes, the PR can be merged from the feature branch into the base branch specified in the PR.

#### Best Practices for creating pull requests
When creating a pull request, follow a few best practices for a smoother review process. 
##### Write small PRs
Aim to create small, focused pull requests that fulfill a single purpose. Smaller pull requests are easier and faster to review and merge, leave less room to introduce bugs, and provide a clearer history of changes.
##### Review your own pull request first
Test your own pull request before submitting it. This will allow you to catch errors or typos that you may have missed, before others start reviewing. Make sure there are no merge conflicts with the branch your are sending the pull request to.
##### Provide context and guidance
Write clear titles and descriptions for your pull requests so that reviewers can quickly understand what the pull request does. In the pull request body, include:
- the purpose of the pull request
- an overview of what changed
- links to any additional context such as tracking issues or previous conversations

You can follow the template that is provided in our repo.

### Draft pull requests
When you create a pull request, you can choose to create a pull request that is ready for review or a draft pull request. Draft pull requests cannot be merged, and code owners are not automatically requested to review draft pull requests.

When you're ready to get feedback on your pull request, you can mark your draft pull request as ready for review. Marking a pull request as ready for review will request reviews from any code owners. You can convert a pull request to a draft at any time.

### Handling merge conflict
Git can often resolve differences between branches and merge them automatically. Usually, the changes are on different lines, or even in different files, which makes the merge simple for computers to understand. However, sometimes there are competing changes that Git can't resolve without your help. Often, merge conflicts happen when people make different changes to the same line of the same file, or when one person edits a file and another person deletes the same file.

You must resolve all merge conflicts before you can merge a pull request on GitHub. If you have a merge conflict between the compare branch and base branch in your pull request, you can view a list of the files with conflicting changes above the Merge pull request button. The Merge pull request button is deactivated until you've resolved all conflicts between the compare branch and base branch.

To resolve a merge conflict, you must manually edit the conflicted file to select the changes that you want to keep in the final merge. There are a couple of different ways to resolve a merge conflict:
- If your merge conflict is caused by competing line changes, such as when people make different changes to the same line of the same file on different branches in your Git repository, you can resolve it on GitHub using the conflict editor. For more information, see "[Resolving a merge conflict on GitHub](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/addressing-merge-conflicts/resolving-a-merge-conflict-on-github)."
- For all other types of merge conflicts, you must resolve the merge conflict in a local clone of the repository and push the change to your branch on GitHub.  For more information, see "[Resolving a merge conflict using the command line.](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/addressing-merge-conflicts/resolving-a-merge-conflict-using-the-command-line)"

### Commits
A helpful technique to use is to focus on the commit messages, using a heading and bullet points.

For the first line of the commit message use a short summary of all the changes (“feat: implement admin middleware”, “fix: update vulnerable package”, “chore: clean up codebase” you get it). Then add a list of bullet points, one for every file you changed.

Sometimes it makes sense to do 1 bullet point for multiple files (you changed a variable in 10 places, you abstracted code to a function and replaced its usage across the project, etc…). The key to the bullet points is to start with “CRUD”-based language: “- added ...,” “- revised ...,” “- removed ...” to indicate the action taken and then add the **WHY** in the explanation: “- added an aria-label attribute to the icon tag since a label wasn’t previously provided and we need to pass accessibility standards.” The why provides every person looking at the code from that moment on all the info they need to choose to refactor it, delete it, etc… in the future.

For more information on writing commit message, see “[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)”

### AI-Assisted Code Generation
We understand that AI tools (such as GitHub Copilot, ChatGPT, or other code generation assistants) can help accelerate development and improve productivity. When using AI-assisted code, please follow these guidelines:

- **Use AI as a helper, not a replacement.**
  AI-generated code should supplement your knowledge, not replace careful coding practices.
- Always review, understand, and test any AI-generated code before submitting it.
- Ensure AI-generated code adheres to the repository’s style guides, naming conventions, and architecture patterns.
- Modify AI suggestions as necessary to maintain readability and maintainability, and remove any unnecessary AI-generated comments.

