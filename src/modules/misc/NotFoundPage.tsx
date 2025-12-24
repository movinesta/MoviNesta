import React from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../../components/shared/TopBar";
import { Button } from "@/components/ui/Button";

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <TopBar title="Not found" />
      <div className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background px-4 text-foreground">
        <div className="relative max-w-lg rounded-3xl border border-border bg-card/90 p-8 text-center shadow-md backdrop-blur">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Not found
            </p>
            <h1 className="text-xl font-heading font-semibold text-foreground">
              This scene is missing
            </h1>
            <p className="text-sm text-muted-foreground">
              The page you&apos;re looking for either moved, never existed, or was removed from our
              current season.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button type="button" size="sm" onClick={() => navigate(-1)}>
              Go back
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate("/auth/signin")}
            >
              Go to sign in
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotFoundPage;
