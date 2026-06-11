import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { AppNotification } from "@holbert/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { IconBell } from "./icons";

export default function NotificationsDropdown() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifs((data as AppNotification[]) ?? []);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const nonLues = notifs.filter((n) => !n.lue).length;

  const ouvrir = async () => {
    setOpen((v) => !v);
    if (!open && nonLues > 0 && user) {
      await supabase
        .from("notifications")
        .update({ lue: true })
        .eq("user_id", user.id)
        .eq("lue", false);
      void load();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={ouvrir}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        aria-label="Notifications"
      >
        <IconBell className="size-5" />
        {nonLues > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
            {nonLues}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
            Notifications
          </div>
          {notifs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Aucune notification.
            </p>
          ) : (
            <ul className="custom-scrollbar max-h-80 overflow-y-auto">
              {notifs.map((n) => (
                <li key={n.id} className="border-b border-gray-50 last:border-0 dark:border-gray-800">
                  <Link
                    to={n.lien ?? "#"}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {n.titre}
                    </p>
                    {n.corps && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{n.corps}</p>
                    )}
                    <p className="mt-1 text-[11px] text-gray-400">
                      {new Date(n.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
