import React from "react";
import TopBar from "@/components/shared/TopBar";

/**
 * Placeholder screen.
 *
 * MoviNesta currently uses the `follows` table without a request/approval state.
 * We keep this screen so the UI can match the Instagram flow and we can
 * implement real follow requests later (private accounts, approvals, etc.).
 */
const FollowRequestsPage: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col bg-black pb-4 text-white">
      <TopBar title="Follow requests" />

      <div className="px-4 py-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Follow requests aren’t available yet.
          <div className="mt-2 text-xs text-white/50">
            When we add private profiles, approvals, and request management, this page will
            become fully functional.
          </div>
        </div>
      </div>
    </div>
  );
};

export default FollowRequestsPage;
