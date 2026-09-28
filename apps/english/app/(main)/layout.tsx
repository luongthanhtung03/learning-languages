import { Nav } from "@/components/Nav";

export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Nav />
      {children}
    </>
  );
}
