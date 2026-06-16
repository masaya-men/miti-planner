// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AdminPage } from '../AdminPage';

describe('AdminPage', () => {
  it('title を見出しとして表示する', () => {
    render(<AdminPage title="テスト見出し">本文</AdminPage>);
    expect(screen.getByRole('heading', { name: 'テスト見出し' })).toBeInTheDocument();
  });

  it('children（本文）を表示する', () => {
    render(<AdminPage title="t">本文ここ</AdminPage>);
    expect(screen.getByText('本文ここ')).toBeInTheDocument();
  });

  it('meta を渡すと表示する', () => {
    render(<AdminPage title="t" meta="60件">x</AdminPage>);
    expect(screen.getByText('60件')).toBeInTheDocument();
  });

  it('actions を渡すと表示する', () => {
    render(<AdminPage title="t" actions={<button>新規</button>}>x</AdminPage>);
    expect(screen.getByRole('button', { name: '新規' })).toBeInTheDocument();
  });
});
