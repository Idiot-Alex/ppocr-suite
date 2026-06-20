export function decodeCtc(
  data: Float32Array | number[],
  dims: readonly number[],
  characters: string[],
): { text: string; score: number } {
  const timeSteps = dims.length >= 3 ? dims[dims.length - 2] : 0;
  const classes = dims.length >= 3 ? dims[dims.length - 1] : characters.length + 1;
  const chars: string[] = [];
  const scores: number[] = [];
  let previousClass = -1;

  for (let step = 0; step < timeSteps; step += 1) {
    const offset = step * classes;
    let bestClass = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let classIndex = 0; classIndex < classes; classIndex += 1) {
      const score = data[offset + classIndex];
      if (score > bestScore) {
        bestScore = score;
        bestClass = classIndex;
      }
    }

    if (bestClass !== 0 && bestClass !== previousClass) {
      chars.push(characters[bestClass - 1] ?? "");
      scores.push(bestScore);
    }

    previousClass = bestClass;
  }

  return {
    text: chars.join(""),
    score: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0,
  };
}

export async function loadCharacterDict(urls: string[]): Promise<string[]> {
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }
      const text = await response.text();
      const characters = url.endsWith(".yml") || url.endsWith(".yaml")
        ? parsePaddleOcrYamlCharacterDict(text)
        : parsePlainCharacterDict(text);

      if (characters.length > 0) {
        return characters;
      }
    } catch {
      // Try the next configured source.
    }
  }

  throw new Error("Unable to load the recognition character dictionary.");
}

function parsePlainCharacterDict(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePaddleOcrYamlCharacterDict(text: string): string[] {
  const characters: string[] = [];
  let inCharacterDict = false;
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (/^\s*character_dict:\s*$/.test(line)) {
      inCharacterDict = true;
      continue;
    }

    if (!inCharacterDict) {
      continue;
    }

    const item = line.match(/^\s*-\s*(.*)$/);
    if (!item) {
      if (/^\S/.test(line)) {
        break;
      }
      continue;
    }

    characters.push(unquoteYamlScalar(item[1]));
  }

  return characters;
}

function unquoteYamlScalar(value: string): string {
  const trimmed = value.trim();

  if (trimmed === "") {
    return "";
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  return trimmed;
}
