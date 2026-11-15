import React, { JSX } from 'react';

interface TopBarProps {
  title: string;
  onTitleClick?: () => void;
}

// The title doubles as a home link: clicking it shows Recent Records.
export default function TopBar(props: TopBarProps): JSX.Element {
  const { title, onTitleClick } = props;

  return (
    <header className="bg-surface border-b border-line px-6 py-3">
      <h1 className="text-heading text-xl font-semibold truncate">
        <button
          type="button"
          onClick={() => onTitleClick?.()}
          className="cursor-pointer text-left hover:underline"
        >
          {title}
        </button>
      </h1>
    </header>
  );
}
