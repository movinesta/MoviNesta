import React from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export const useSendMessage = (_conversationId?: string) => {
  return {
    isPending: false,
    mutate: () => {},
  };
};

const CONVERSATION_MARKUP = `
<div class="bg-background-light dark:bg-background-dark font-display h-screen flex flex-col overflow-hidden text-slate-900 dark:text-white antialiased selection:bg-primary selection:text-white">
  <header class="shrink-0 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md sticky top-0 z-20 border-b border-black/5 dark:border-white/5">
    <div class="flex items-center gap-3">
      <button class="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <div class="relative">
        <div class="size-10 rounded-full bg-cover bg-center border border-white/10" data-alt="Portrait of Sarah Jenkins" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuDpmQpCzzqMs_TH6P1JpuYQhPxUxaqjax4fdX5SIeduaN4lr35gzVm06_PyGTOzAc6J7ZM5YXkhJfCAV0plam7NHZ7BrO8eZIba9ocdHyjQV_hpYonugatylRKwpxiofn8wJEsuui4IdCTjXiyuu-F06Te53QqeVMHA7SLEiRKOywQ_4z48u1kB-Kq7gX3rgiL-_ZOP6Zfu8Wji2yNHFe6CDk-IC9o4WCusxleXPsqlaad5vShId9c6Y8c0A6UAGqTTTPrekpDvHIQ');"></div>
        <div class="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-background-light dark:border-background-dark rounded-full"></div>
      </div>
      <div class="flex flex-col">
        <h1 class="text-base font-bold leading-none text-slate-900 dark:text-white">Sarah Jenkins</h1>
        <p class="text-xs text-primary font-medium mt-1 animate-pulse">Watching: Dune: Part Two</p>
      </div>
    </div>
    <div class="flex items-center gap-1">
      <button class="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors">
        <span class="material-symbols-outlined">videocam</span>
      </button>
      <button class="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors">
        <span class="material-symbols-outlined">info</span>
      </button>
    </div>
  </header>
  <main class="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide w-full max-w-3xl mx-auto">
    <div class="flex justify-center py-2">
      <span class="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-black/5 dark:bg-white/5 px-3 py-1 rounded-full">Today</span>
    </div>
    <div class="group flex items-end gap-3 w-full">
      <div class="size-8 rounded-full bg-cover bg-center shrink-0 mb-1" data-alt="Portrait of Sarah Jenkins" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuBtPtxGiG4yiXRnFDSu2_iTSXDg6D9KEZlxQKX8jZOO97sZV4bZHNJ__EkUyP6AijcgJnpMTv2a_HIzbWNDkJOhU17a4VHXsmFwcQ_2ScQOMqemW0dPRjPqs73Ulpmv9Ese8rogAtv1UUTDilF929Hje_LFjGeq6ReVm0CwH_01Hr1zA4Z0ZPTudyxZcbuKAjXbTz0tqz2imv6VWxaZHTDWt_Kr9g53Qqn9iknmw48u118tTRdCVsDfLZvrxy3CEjIFsLGLKb43IgI');"></div>
      <div class="flex flex-col gap-1 max-w-[80%] md:max-w-[60%]">
        <span class="text-xs text-slate-500 ml-1">Sarah, 8:42 PM</span>
        <div class="px-5 py-3 bg-gray-200 dark:bg-bubble-incoming rounded-2xl rounded-tl-sm text-slate-800 dark:text-slate-100 text-[15px] leading-relaxed shadow-sm">
          Did you catch the finale of The Last of Us?
        </div>
      </div>
    </div>
    <div class="group flex flex-row-reverse items-end gap-3 w-full">
      <div class="size-8 rounded-full bg-cover bg-center shrink-0 mb-1" data-alt="Portrait of user" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuAK_Rt9jj5-zOslw6I9TPMXJYJLSEfKvhtaPoOok53ceU2t4QL7Q-gK8ddR0JZIbRfmgu3_qbmmGGo0iK6GwUH3A03qs31nvlXTO8G4O_STJaaKqZI4uHrMNh02F_xvjEq2GYxfekMk8rbIjl7-TOrOWEUEvJeDA_rde3oBoa1cX61KiMkybHNWXX3S_Vni_Q-_lymOV1jdv40_u8uChnsU94UNl-yR708E6225anVTHsWLKmMwgLcY7FxMkCDus4mvP5DCG7O1zCo');"></div>
      <div class="flex flex-col items-end gap-1 max-w-[80%] md:max-w-[60%]">
        <span class="text-xs text-slate-500 mr-1">8:45 PM</span>
        <div class="px-5 py-3 bg-primary text-white rounded-2xl rounded-tr-sm text-[15px] leading-relaxed shadow-glow">
          Yes! I was literally crying 😭.
        </div>
      </div>
    </div>
  </main>
  <footer class="shrink-0 border-t border-black/5 dark:border-white/5 bg-white/90 dark:bg-background-dark/90 backdrop-blur-md px-4 py-3">
    <div class="flex items-center gap-3">
      <button class="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors">
        <span class="material-symbols-outlined">add</span>
      </button>
      <div class="flex-1">
        <input class="w-full rounded-full bg-gray-100 dark:bg-surface-dark px-4 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Type a message" />
      </div>
      <button class="p-2 rounded-full bg-primary text-white shadow-glow">
        <span class="material-symbols-outlined">send</span>
      </button>
    </div>
  </footer>
</div>
`;

const ConversationPage: React.FC = () => {
  useDocumentTitle("Conversation");

  return <div className="conversation-page" dangerouslySetInnerHTML={{ __html: CONVERSATION_MARKUP }} />;
};

export default ConversationPage;
