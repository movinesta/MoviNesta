import React from "react";
import DiaryLibraryTab from "../diary/DiaryLibraryTab";

/**
 * ProfileDiaryTab
 *
 * For now this simply reuses the main Diary library UI for the
 * currently signed-in user. Later this can accept a userId/profile
 * prop to show a public slice of any user&apos;s diary.
 */
const ProfileDiaryTab: React.FC = () => {
  return (
    <div className="mt-2">
      <DiaryLibraryTab />
    </div>
  );
};

export default ProfileDiaryTab;
