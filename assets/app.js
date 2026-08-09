(() => {
  "use strict";

  const owner = "JWKNT";
  const hiddenRepos = new Set([`${owner}.github.io`.toLowerCase(), "site-theme"]);
  const names = {
    "albatross-koukairoku": "Albatross Koukairoku",
    bl2: "Borderlands 2 Armory",
    "black-sheep-town": "Black Sheep Town",
    "logical-solver": "U-Bahn Solver",
    "mtl-guide": "MTL Guide",
    puzzles: "Puzzles",
  };
  const descriptions = {
    "albatross-koukairoku": "A searchable Japanese and English script reader.",
    bl2: "A searchable guide to legendary and unique items.",
    "black-sheep-town": "A searchable Japanese and English script reader.",
    "logical-solver": "An interactive solver for U-Bahn logic puzzles.",
    "mtl-guide": "A reusable process for machine-assisted visual novel translation.",
    puzzles: "A searchable collection of original logic puzzles.",
  };

  const list = document.querySelector("#projects");
  const status = document.querySelector("#project-status");

  function titleFor(repo) {
    return names[repo.name] || repo.name.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function sentenceFor(repo) {
    const text = descriptions[repo.name] || repo.description || "";
    if (!text) return "";
    const firstSentence = text.match(/^.*?[.!?](?:\s|$)/)?.[0] || text;
    return /[.!?]$/.test(firstSentence) ? firstSentence : `${firstSentence}.`;
  }

  function projectUrl(repo) {
    if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      return `https://${owner.toLowerCase()}.github.io/${encodeURIComponent(repo.name)}/`;
    }
    return `/${encodeURIComponent(repo.name)}/`;
  }

  function render(repos) {
    const fragment = document.createDocumentFragment();
    for (const repo of repos) {
      const item = document.createElement("li");
      item.dataset.project = repo.name;

      const link = document.createElement("a");
      link.href = projectUrl(repo);
      link.textContent = titleFor(repo);
      item.append(link);

      const sentence = sentenceFor(repo);
      if (sentence) {
        const description = document.createElement("span");
        description.textContent = sentence;
        item.append(description);
      }
      fragment.append(item);
    }
    list.replaceChildren(fragment);
  }

  fetch(`https://api.github.com/users/${owner}/repos?per_page=100&sort=full_name`, {
    headers: { Accept: "application/vnd.github+json" },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      return response.json();
    })
    .then((repos) => {
      const projects = repos
        .filter((repo) => repo.has_pages && !repo.archived && !hiddenRepos.has(repo.name.toLowerCase()))
        .sort((a, b) => titleFor(a).localeCompare(titleFor(b)));
      if (projects.length) render(projects);
      status.textContent = "";
    })
    .catch(() => {
      status.textContent = "Showing the saved project list.";
    });
})();
