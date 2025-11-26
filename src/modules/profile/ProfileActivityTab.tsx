import React from "react";
import DiaryTimelineTab from "../diary/DiaryTimelineTab";

/**
 * ProfileActivityTab
 *
 * For now this simply reuses the main Diary timeline UI for the
 * currently signed-in user. Later this can accept a userId/profile
 * prop to show activity for any profile.
 */
const ProfileActivityTab: React.FC = () => {
  return (
    <div className="mt-2">
      <DiaryTimelineTab />
    </div>
  );
};

export default ProfileActivityTab;
