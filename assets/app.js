(() => {
  "use strict";

  const owner = "JWKNT";
  const hiddenRepos = new Set([`${owner}.github.io`.toLowerCase(), "site-theme"]);
  const known = new Set([...document.querySelectorAll("[data-project]")].map((item) => item.dataset.project));
  const otherSection = document.querySelector("#other-projects");
  const otherList = document.querySelector("#other-project-list");
  const status = document.querySelector("#project-status");

  function titleFor(name) {
    return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  fetch(`https://api.github.com/users/${owner}/repos?per_page=100&sort=full_name`, {
    headers: { Accept: "application/vnd.github+json" },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      return response.json();
    })
    .then((repos) => {
      const additions = repos
        .filter((repo) => repo.has_pages && !repo.archived && !hiddenRepos.has(repo.name.toLowerCase()) && !known.has(repo.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const repo of additions) {
        const item = document.createElement("li");
        item.dataset.project = repo.name;
        const link = document.createElement("a");
        link.href = `https://jehlp.net/${encodeURIComponent(repo.name)}/`;
        link.textContent = titleFor(repo.name);
        item.append(link);
        if (repo.description) {
          const description = document.createElement("span");
          description.textContent = repo.description;
          item.append(description);
        }
        otherList.append(item);
      }
      otherSection.hidden = additions.length === 0;
      status.textContent = "";
    })
    .catch(() => {
      status.textContent = "Saved project index shown.";
    });
})();
