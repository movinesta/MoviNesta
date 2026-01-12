import React from "react";
import DiaryTimelineTab from "../diary/DiaryTimelineTab";

interface ProfileActivityTabProps {
  profileId: string;
  displayName?: string | null;
  username?: string | null;
  isCurrentUser?: boolean;
}

const ProfileActivityTab: React.FC<ProfileActivityTabProps> = ({
  profileId,
  displayName,
  username,
  isCurrentUser = false,
}) => {
  return (
    <div className="mt-2">
      <DiaryTimelineTab
        userId={profileId}
        isOwnProfile={isCurrentUser}
        displayName={displayName}
        username={username}
      />
    </div>
  );
};

export default ProfileActivityTab;
