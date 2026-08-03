import { createHash } from "node:crypto";

const TEXT_FILE_PATTERN = /\.(md|json|ya?ml|toml|txt|env|example|[cm]?[jt]sx?|css|html|astro)$/i;

export function hashGeneratedContent(content, relativePath) {
  const normalized = TEXT_FILE_PATTERN.test(relativePath)
    ? content.toString("utf8").replaceAll("\r\n", "\n").replaceAll("\r", "\n")
    : content;
  return createHash("sha256").update(normalized).digest("hex");
}

