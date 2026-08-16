import CinemaExperience from "@/components/CinemaExperience";
import { I18nProvider } from "@/lib/i18n";

export default function Home() {
  return (
    <I18nProvider>
      <CinemaExperience />
    </I18nProvider>
  );
}
