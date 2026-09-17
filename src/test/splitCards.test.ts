import { describe, expect, it } from 'vitest';
import { parseCards } from '../utils/splitCards';

describe('parseCards', () => {
  it('Q/A 标记 + --- 分隔', () => {
    const text = `Q: 什么是剩余价值？\nA: 工人创造的超过劳动力价值的部分\n---\n问：唯物辩证法的总特征\n答：联系\n发展`;
    expect(parseCards(text)).toEqual([
      { question: '什么是剩余价值？', answer: '工人创造的超过劳动力价值的部分' },
      { question: '唯物辩证法的总特征', answer: '联系\n发展' },
    ]);
  });

  it('无标记时首行为问题', () => {
    expect(parseCards('三大改造\n农业、手工业、资本主义工商业')).toEqual([
      { question: '三大改造', answer: '农业、手工业、资本主义工商业' },
    ]);
  });

  it('多行问题', () => {
    expect(parseCards('Q: 第一行\n第二行\nA: 答案')).toEqual([{ question: '第一行\n第二行', answer: '答案' }]);
  });

  it('跳过空块，兼容 CRLF 与全角冒号', () => {
    expect(parseCards('\r\n---\r\nQ：甲\r\nA：乙\r\n---\r\n\r\n')).toEqual([{ question: '甲', answer: '乙' }]);
  });

  it('只有答案标记', () => {
    expect(parseCards('概念\nA: 解释')).toEqual([{ question: '概念', answer: '解释' }]);
  });
});
