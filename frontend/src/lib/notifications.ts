export type AlertPreview = {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info";
  cluster: string;
  resource: string;
  time: string;
};

export const NOTIFICATION_ALERTS: AlertPreview[] = [
  {
    id: "pod-oomkilled",
    title: "Pod OOMKilled",
    severity: "critical",
    cluster: "prod-eks-apac",
    resource: "payment-service",
    time: "7m ago",
  },
  {
    id: "envoy-crashloop",
    title: "Envoy Gateway CrashLoop",
    severity: "critical",
    cluster: "prod-eks-us",
    resource: "envoy-proxy",
    time: "15m ago",
  },
  {
    id: "node-disk-pressure",
    title: "Node disk pressure",
    severity: "warning",
    cluster: "prod-eks-apac",
    resource: "ip-10-0-1-23",
    time: "22m ago",
  },
  {
    id: "cpu-high",
    title: "CPU usage > 90%",
    severity: "warning",
    cluster: "staging-eks",
    resource: "node-2",
    time: "1h ago",
  },
  {
    id: "image-pull-backoff",
    title: "Image pull backoff",
    severity: "warning",
    cluster: "dev-eks",
    resource: "user-service",
    time: "2h ago",
  },
  {
    id: "pvc-usage",
    title: "PVC usage > 80%",
    severity: "info",
    cluster: "prod-eks-us",
    resource: "data-volume",
    time: "2h ago",
  },
];

export const ALERT_BADGE_COUNT = 4;
