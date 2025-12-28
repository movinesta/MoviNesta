import React from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const PROFILE_MARKUP = `
<div class="bg-background-light dark:bg-background-dark font-display text-gray-900 dark:text-white antialiased overflow-x-hidden selection:bg-primary selection:text-white">
  <div class="relative flex min-h-screen w-full flex-col pb-24">
    <div class="relative w-full h-80 shrink-0 group">
      <div class="absolute inset-0 bg-cover bg-center bg-no-repeat" data-alt="Cinematic desert landscape with dual moons at twilight" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBbBh67HyaZ8b0i6MpjByeXHbHpeudi3nekV1GQ5HeAhZe3fGJAI4Zoo4xpLkauM7aQ7EgVJgmUA5wwgomhBD7THR-L9rk80NG-fUvlZQJXH8W96-brfCkOOtQUmK2dHFsaSRLpgqjRzVf2ofZQJBNZUqhH9qui1kUN-QHxCeHWbcXsRM9lKojy4dqMnadDeu7-hlkzXYNuzm5z8y-KsD4e79w3bO6ltyGzukojcQFz_5paZ-FLIZT62lfIo8DoS_OkDd0hIKPYpB4");'>
      </div>
      <div class="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-background-dark"></div>
      <div class="absolute top-0 left-0 w-full z-20 flex items-center justify-between p-4 pt-12 md:pt-6">
        <button class="flex size-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-md hover:bg-black/40 transition-colors text-white">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div class="flex gap-3">
          <button class="flex size-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-md hover:bg-black/40 transition-colors text-white">
            <span class="material-symbols-outlined">search</span>
          </button>
          <button class="flex size-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-md hover:bg-black/40 transition-colors text-white">
            <span class="material-symbols-outlined">settings</span>
          </button>
        </div>
      </div>
    </div>
    <div class="relative px-5 -mt-20 z-10">
      <div class="flex flex-col items-start gap-4">
        <div class="relative">
          <div class="absolute -inset-2 bg-primary/30 rounded-full blur-md"></div>
          <div class="relative size-28 rounded-full border-4 border-background-dark bg-surface-dark bg-cover bg-center shadow-xl" data-alt="Portrait of a young man with neon lighting" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBO5L0LBu1c4Lp_E6T8tu0YsPLQ9EIwgM6YuFQPUrmFagND1H-LxCE5WwZoaNIpT-wVzSrjgYoyDgwu7HD_4pCyOCeMd-1VvrW3wItHdcRbl34fxjqIWR-DBQB7x-fTR0sPZnl7KjveLtDUf1fcE8XaNqvsHAZfkE-PlE_bYW3P6FmaQg-PHRGoHPnwQ6hgsrlK4kpLt-7i5IcRyebJUs_qUsFp2b9bhezEc0RmZHx9Fh2-VnBd4xKV5M7nFn0TjFaT_OYKoZKM2bU");'>
          </div>
        </div>
        <div class="w-full">
          <div class="flex justify-between items-start">
            <div>
              <h1 class="text-3xl font-bold leading-tight tracking-tight">Alex Chen</h1>
              <p class="text-gray-400 font-medium text-base mt-1">@alexc</p>
            </div>
            <div class="flex gap-2 mt-1">
              <button class="h-9 px-5 rounded-full bg-white/10 hover:bg-white/20 border border-white/5 text-sm font-semibold text-white transition-colors">Edit</button>
              <button class="size-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/5 text-white transition-colors">
                <span class="material-symbols-outlined text-[20px]">ios_share</span>
              </button>
            </div>
          </div>
          <p class="text-gray-300 text-sm leading-relaxed mt-3 max-w-sm">
            Sci-fi addict & practical effects enthusiast. Usually rewatching Blade Runner 2049. 🎬✨
          </p>
        </div>
      </div>
    </div>
    <div class="flex justify-between px-6 py-8">
      <div class="flex flex-col items-center gap-1 group cursor-pointer">
        <span class="text-2xl font-bold text-white group-hover:text-primary transition-colors">412</span>
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Watched</span>
      </div>
      <div class="flex flex-col items-center gap-1 group cursor-pointer">
        <span class="text-2xl font-bold text-white group-hover:text-primary transition-colors">15</span>
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Lists</span>
      </div>
      <div class="flex flex-col items-center gap-1 group cursor-pointer">
        <span class="text-2xl font-bold text-white group-hover:text-primary transition-colors">2.4k</span>
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Followers</span>
      </div>
      <div class="flex flex-col items-center gap-1 group cursor-pointer">
        <span class="text-2xl font-bold text-white group-hover:text-primary transition-colors">890</span>
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Following</span>
      </div>
    </div>
  </div>
</div>
`;

const ProfilePage: React.FC = () => {
  useDocumentTitle("Profile");

  return <div dangerouslySetInnerHTML={{ __html: PROFILE_MARKUP }} />;
};

export default ProfilePage;
