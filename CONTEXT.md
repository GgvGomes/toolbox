# Toolbox

Personal, public catalog of external tools, searchable by humans and AI agents.

## Language

**Tool**:
A catalog entry pointing to an external thing (repo, site, package, service) via a public reference link, with a short description.
_Avoid_: item, entry, resource

**Reference**:
The public link of a **Tool** (URL). Always committed.
_Avoid_: source, url

**Local Link**:
Path to where a **Tool** already exists on the owner's machine. Lives only on that machine, never committed.
_Avoid_: local path, install path

**Category**:
Domain a **Tool** belongs to (e.g. AI, Security). A **Tool** has one or more. Synonym used by owner: "classe".
_Avoid_: class, folder, section

**Kind**:
Format/nature of a **Tool** (e.g. CLI, library, MCP server). Exactly one per **Tool**.
_Avoid_: type

**Tag**:
Free-form label on a **Tool** for finer search (e.g. scanner, sast).

**Maintainer**:
Someone with a git clone of the toolbox who can add **Tools** and publish them. Others only consume.
_Avoid_: admin, owner, contributor

**Consumer**:
Someone who uses the toolbox (as a plugin or by reading it) to find **Tools**, without adding to it.

**Catalog**:
The full generated index of all **Tools**, readable by machines and humans.

## Relationships

- A **Tool** has exactly one **Reference**, one **Kind**, one or more **Categories**, zero or more **Tags**
- A **Tool** has zero or one **Local Link** per machine
- The **Catalog** contains every **Tool** but no **Local Links**

## Example dialogue

> **Dev:** "Is there a **Tool** for scanning a project for vulnerabilities with AI?"
> **Agent:** "Yes — one in **Categories** AI and Security, **Kind** CLI, **Tag** scanner. Its **Reference** is the GitHub repo, and you have a **Local Link** at ~/softs/scanner."

## Flagged ambiguities

- "classe" was used for both domain and format — resolved: "classe" = **Category**; format = **Kind**.
