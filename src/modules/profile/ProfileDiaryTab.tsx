import React from "react";
import DiaryLibraryTab from "../diary/DiaryLibraryTab";

interface ProfileDiaryTabProps {
  profileId: string;
  displayName?: string | null;
  username?: string | null;
  isCurrentUser?: boolean;
}

const ProfileDiaryTab: React.FC<ProfileDiaryTabProps> = ({
  profileId,
  displayName,
  username,
  isCurrentUser = false,
}) => {
  return (
    <div className="mt-2">
      <DiaryLibraryTab
        userId={profileId}
        isOwnProfile={isCurrentUser}
        displayName={displayName}
        username={username}
      />
    </div>
  );
};

export default ProfileDiaryTab;
