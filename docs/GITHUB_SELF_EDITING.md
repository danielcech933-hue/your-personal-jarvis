# GitHub self-editing

JARVIS has server-side tools for reading and changing its own repository.

## Required server secret

Set `GITHUB_TOKEN` in the deployed server environment. The token must have access to this repository:

`danielcech933-hue/your-personal-jarvis`

For least privilege, give it only the repository permissions needed for reading/writing repository contents, creating branches and creating pull requests. Never put the token in browser code, localStorage, prompts, or user-visible configuration.

## Runtime workflow

JARVIS should use:

1. `github_search_self_code` or `github_list_self_files`
2. `github_read_self_file`
3. `github_create_self_branch`
4. `github_write_self_file`
5. verify the resulting build/tests using the deployment/CI system
6. `github_create_self_pr`

The built-in guard only allows `src/`, `public/`, and `docs/` paths and refuses direct writes to `main`.

## Important limitation

The repository connector used while developing the application is not the same credential as the deployed application's `GITHUB_TOKEN`. The token must therefore be configured separately in the server environment before JARVIS can edit GitHub at runtime.
