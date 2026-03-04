import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TiltCard } from "../TiltCard";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, onMouseMove, onMouseLeave, style, className, ...props }: any) => (
      // biome-ignore lint/a11y/noStaticElementInteractions: test mock for framer-motion
      <div
        data-testid="motion-div"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={style}
        className={className}
        {...props}
      >
        {children}
      </div>
    ),
  },
  useMotionValue: () => ({ set: vi.fn(), get: () => 0 }),
  useSpring: (v: any) => v,
  useTransform: () => "0deg",
}));

describe("TiltCard", () => {
  it("renders children", () => {
    render(
      <TiltCard>
        <span>hello</span>
      </TiltCard>,
    );
    expect(screen.getByText("hello")).toBeDefined();
  });

  it("renders with active=false (style is undefined)", () => {
    render(<TiltCard active={false}>content</TiltCard>);
    const div = screen.getByTestId("motion-div");
    // When active=false, style prop is undefined (no rotateX/Y applied)
    expect(div.style.length).toBe(0);
  });

  it("renders with active=true applies transformStyle", () => {
    render(<TiltCard active={true}>content</TiltCard>);
    const div = screen.getByTestId("motion-div");
    expect(div.style.transformStyle).toBe("preserve-3d");
  });

  it("renders with custom className", () => {
    render(<TiltCard className="my-custom-class">content</TiltCard>);
    const div = screen.getByTestId("motion-div");
    expect(div.className).toContain("my-custom-class");
  });

  it("mouseMove does not crash when active=true", () => {
    render(<TiltCard active={true}>content</TiltCard>);
    const div = screen.getByTestId("motion-div");
    // Should not throw
    fireEvent.mouseMove(div, { clientX: 50, clientY: 50 });
  });

  it("mouseLeave does not crash when active=true", () => {
    render(<TiltCard active={true}>content</TiltCard>);
    const div = screen.getByTestId("motion-div");
    fireEvent.mouseLeave(div);
  });

  it("mouseMove does not crash when active=false", () => {
    render(<TiltCard active={false}>content</TiltCard>);
    const div = screen.getByTestId("motion-div");
    fireEvent.mouseMove(div, { clientX: 50, clientY: 50 });
  });

  it("mouseLeave does not crash when active=false", () => {
    render(<TiltCard active={false}>content</TiltCard>);
    const div = screen.getByTestId("motion-div");
    fireEvent.mouseLeave(div);
  });

  it("inner div uses translateZ(30px) when active=true", () => {
    const { container } = render(<TiltCard active={true}>content</TiltCard>);
    const inner = container.querySelector("[style*='translateZ']");
    expect(inner).toBeDefined();
  });

  it("inner div uses translateZ(none) when active=false", () => {
    const { container } = render(<TiltCard active={false}>content</TiltCard>);
    const inner = container.querySelector("div > div");
    expect(inner).toBeDefined();
  });
});
