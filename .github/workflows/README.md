# Workflows are intentionally inactive

Copy `templates/github-actions/ci.example.yml` to `.github/workflows/ci.yml` **only after** your project has the listed `npm run` scripts and isolated secrets. A YAML workflow placed inside `.github/workflows/` is not inert merely because its filename contains `example`.
