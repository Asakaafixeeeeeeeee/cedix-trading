'use client';
import { SystemAvatar } from './shared';

/** Shown when a device has no activated Messages session. No login form —
 * access is granted only through an admin invitation link. */
export default function MessagesWelcome() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 pb-16">
      <SystemAvatar size={72} />
      <h1 className="mt-4 text-[26px] font-bold">Messages</h1>
      <p className="mt-1 max-w-xs text-center text-[13px] leading-relaxed text-[#8e8e93]">
        Private CediX Trading transaction notifications.
      </p>
      <div className="mt-8 max-w-xs rounded-2xl bg-[#f2f2f7] px-5 py-4 text-center">
        <p className="text-[13px] font-medium">This device is not activated</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[#8e8e93]">
          Messages is available by invitation only. If you received an invitation link from the CediX team, open it
          on this device to activate. Otherwise, contact CediX support to request access.
        </p>
      </div>
    </div>
  );
}
