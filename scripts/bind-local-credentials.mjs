#!/usr/bin/env node
// Points imported workflows at this machine's real n8n credentials.
//
// Committed workflow files carry placeholder credential IDs such as
// "phase3Anthropic" so that instance-specific IDs never enter Git. n8n matches
// a credential by ID, not by name, so a freshly imported workflow fails with
// "Credential with ID <placeholder> does not exist" until the placeholder is
// replaced. This script performs that replacement locally, using the mapping in
// n8n/credentials.local.json, which is ignored by Git.
//
// Run it after import-workflows, then restart n8n.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workflowDir = join(projectRoot, "n8n", "workflows");
const mapPath = join(projectRoot, "n8n", "credentials.local.json");
const examplePath = join(projectRoot, "n8n", "credentials.local.example.json");
const n8nBin = join(projectRoot, "node_modules", "n8n", "bin", "n8n");
const userFolder = join(projectRoot, "data", "n8n");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (!existsSync(mapPath)) {
  fail(
    `No credential map found at n8n/credentials.local.json.\n` +
      `Copy ${examplePath} to that path and fill in your own credential IDs.`,
  );
}
if (!existsSync(n8nBin)) {
  fail("The local n8n engine is not installed. Run setup first.");
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(mapPath, "utf8"));
} catch (error) {
  fail(`n8n/credentials.local.json is not valid JSON: ${error.message}`);
}

const mapping = Object.entries(parsed?.credentials ?? {}).filter(
  ([placeholder, actual]) =>
    typeof placeholder === "string" &&
    typeof actual === "string" &&
    actual.trim() !== "" &&
    !actual.startsWith("REPLACE_WITH_"),
);
if (mapping.length === 0) {
  fail("n8n/credentials.local.json has no usable credential IDs yet.");
}

// Rewrite only the "id" of a credential reference. Names and every other field
// are left exactly as committed.
function bindCredentials(workflow) {
  let replacements = 0;
  for (const node of workflow.nodes ?? []) {
    for (const reference of Object.values(node.credentials ?? {})) {
      for (const [placeholder, actual] of mapping) {
        if (reference?.id === placeholder) {
          reference.id = actual;
          replacements += 1;
        }
      }
    }
  }
  return replacements;
}

const staging = mkdtempSync(join(tmpdir(), "ai-solo-credentials-"));
const touched = [];
const unmapped = new Set();

try {
  for (const entry of readdirSync(workflowDir)) {
    if (!entry.endsWith(".json")) continue;
    const raw = readFileSync(join(workflowDir, entry), "utf8");
    const workflow = JSON.parse(raw);
    const replaced = bindCredentials(workflow);
    for (const node of workflow.nodes ?? []) {
      for (const reference of Object.values(node.credentials ?? {})) {
        if (typeof reference?.id === "string" && /^phase[0-9]/.test(reference.id)) {
          unmapped.add(reference.id);
        }
      }
    }
    if (replaced === 0) continue;
    writeFileSync(join(staging, entry), JSON.stringify(workflow, null, 2), "utf8");
    touched.push({ entry, workflowId: workflow.id, replaced });
  }

  if (touched.length === 0) {
    process.stdout.write("No workflow referenced a mapped placeholder. Nothing to do.\n");
  } else {
    const result = spawnSync(
      process.execPath,
      [n8nBin, "import:workflow", "--separate", `--input=${staging}`],
      {
        env: { ...process.env, N8N_USER_FOLDER: userFolder },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    if (result.status !== 0) {
      fail(
        `Importing credential-bound workflows failed.\n${result.stderr || result.stdout || ""}`,
      );
    }
    for (const item of touched) {
      process.stdout.write(
        `bound ${item.replaced} credential reference(s) in ${item.entry}\n`,
      );
    }
  }

  const stillUnmapped = [...unmapped].filter(
    (placeholder) => !mapping.some(([mapped]) => mapped === placeholder),
  );
  if (stillUnmapped.length > 0) {
    process.stdout.write(
      `\nNot yet mapped (those tools stay unavailable until you add them):\n` +
        stillUnmapped.map((id) => `  - ${id}`).join("\n") +
        `\n`,
    );
  }
  process.stdout.write("\nRestart the app so n8n reloads the bound workflows.\n");
} finally {
  rmSync(staging, { recursive: true, force: true });
}
