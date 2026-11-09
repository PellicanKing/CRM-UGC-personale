import { imapConfig, providerName, smtpConfig } from "@/lib/email/config";
import { getSettings } from "@/lib/queries";
import EmailPanel from "./EmailPanel";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const s = getSettings();
  const smtp = smtpConfig();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Impostazioni</h1>
      <EmailPanel
        provider={providerName()}
        from={process.env.MAIL_FROM_ADDRESS ?? smtp?.user ?? null}
        smtpHost={smtp ? `${smtp.host}:${smtp.port}` : null}
        imapReady={Boolean(imapConfig())}
      />
      <SettingsForm settings={s} />
    </div>
  );
}
