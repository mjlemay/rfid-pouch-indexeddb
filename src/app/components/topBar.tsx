import React, { JSX } from 'react';

interface TopBarProps {
  title: string;
}

export default function TopBar(props: TopBarProps): JSX.Element {
  const { title } = props;

  return (
    <header className="bg-surface border-b border-line px-6 py-3">
      <h1 className="text-heading text-xl font-semibold truncate">{title}</h1>
    </header>
  );
}
