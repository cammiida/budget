import { Outlet } from "@remix-run/react";
import { Navbar } from "~/components/ui/navbar";

export default function AuthenticatedLayout() {
  return (
    <>
      <div className="w-64">
        <Navbar />
      </div>
      <div className="ml-64 max-h-screen min-h-screen overflow-auto px-6">
        <Outlet />
      </div>
    </>
  );
}
