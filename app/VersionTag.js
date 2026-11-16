import { APP_VERSION } from "@/lib/version";

export default function VersionTag() {
  return <span className="ver-tag" aria-label={"Telsiz versiyon " + APP_VERSION}>Telsiz v{APP_VERSION}</span>;
}
