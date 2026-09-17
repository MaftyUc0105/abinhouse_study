export interface ParsedCard {
  question: string;
  answer: string;
}

const SEPARATOR = /^\s*-{3,}\s*$/;
const Q_MARK = /^\s*(?:Q|q|问)\s*[:：]\s*/;
const A_MARK = /^\s*(?:A|a|答)\s*[:：]\s*/;

/**
 * 解析拆卡文本：
 * - 卡片之间用一行 `---` 分隔
 * - 卡内以 `Q:` / `问：` 开头的行为问题，`A:` / `答：` 之后为答案
 * - 没有标记时：第一行是问题，其余是答案
 */
export function parseCards(text: string): ParsedCard[] {
  const chunks: string[][] = [[]];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (SEPARATOR.test(line)) chunks.push([]);
    else chunks[chunks.length - 1].push(line);
  }

  const cards: ParsedCard[] = [];
  for (const rawLines of chunks) {
    const lines = trimBlank(rawLines);
    if (lines.length === 0) continue;

    const qIdx = lines.findIndex((l) => Q_MARK.test(l));
    const aIdx = lines.findIndex((l, i) => i > qIdx && A_MARK.test(l));

    let question: string;
    let answer: string;
    if (qIdx >= 0 && aIdx > qIdx) {
      question = [lines[qIdx].replace(Q_MARK, ''), ...lines.slice(qIdx + 1, aIdx)].join('\n');
      answer = [lines[aIdx].replace(A_MARK, ''), ...lines.slice(aIdx + 1)].join('\n');
    } else if (qIdx >= 0) {
      question = lines[qIdx].replace(Q_MARK, '');
      answer = lines.slice(qIdx + 1).join('\n');
    } else if (aIdx >= 0) {
      question = lines.slice(0, aIdx).join('\n');
      answer = [lines[aIdx].replace(A_MARK, ''), ...lines.slice(aIdx + 1)].join('\n');
    } else {
      question = lines[0];
      answer = lines.slice(1).join('\n');
    }

    question = question.trim();
    answer = answer.trim();
    if (!question && !answer) continue;
    cards.push({ question: question || '（无问题）', answer });
  }
  return cards;
}

function trimBlank(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') start++;
  while (end > start && lines[end - 1].trim() === '') end--;
  return lines.slice(start, end);
}
