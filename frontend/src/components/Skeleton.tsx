import React from "react";

export function Skeleton({ style }: { style?: React.CSSProperties }) {
  return <div className="skeleton" style={style} />;
}

