import { APP_VERSION } from "@/lib/version";

export default function VersionTag() {
  return <span className="ver-tag" aria-label={"Versiyon " + APP_VERSION}>v{APP_VERSION}</span>;
}
