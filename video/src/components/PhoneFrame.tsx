import React from "react";

export const PhoneFrame: React.FC<{
  children: React.ReactNode;
  width?: number;
}> = ({ children, width = 320 }) => {
  const height = width * (16 / 9);
  const bezel = 12;
  const radius = 36;

  return (
    <div
      style={{
        width: width + bezel * 2,
        height: height + bezel * 2,
        background: "#2a2a2a",
        borderRadius: radius,
        padding: bezel,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}
    >
      <div
        style={{
          width,
          height,
          borderRadius: radius - bezel,
          overflow: "hidden",
          background: "#000",
        }}
      >
        {children}
      </div>
    </div>
  );
};
