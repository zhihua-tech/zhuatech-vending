[简体中文](README.md) | **English**

# ZhuaTech Vending

> A source-available enterprise project by [ZhuaTech](https://www.zhuatech.cn/) for connected devices, edge operations, and multi-screen experiences.

ZhuaTech Vending provides a practical, self-hosted foundation for connected devices, edge operations, and multi-screen experiences. It is designed for device operators, field teams, service managers, and platform administrators, with clear business records, controlled workflows, operational visibility, and auditable actions.

This repository is intended for learning, technical evaluation, and non-commercial collaboration. The included implementation, tests, database resources, and container configuration provide a reproducible starting point for further enterprise adaptation.

**Search topics:** enterprise vending, self-hosted vending, self-hosted enterprise software, digital transformation.

## Product Scope

- **Primary users:** Device operators, field teams, service managers, and platform administrators.
- **Deployment model:** Self-hosted, with container-based local deployment where supported.
- **Governance baseline:** Role-aware operations, validation, approval boundaries, exception handling, and auditability.
- **Production boundary:** Review security, identity, backup, observability, capacity, and compliance controls before production use.

## Capability Map

- **Product** — Manage product with ownership, validation, and explicit lifecycle states.
- **Machine** — Coordinate machine through controlled workflows and approval gates.
- **Slot** — Track slot metrics, exceptions, deadlines, and follow-up actions.
- **Promotion** — Preserve promotion evidence in searchable, traceable operational history.
- **Order** — Expose order in role-aware user and administration workspaces.
- **Order Line** — Connect order line to external systems through configurable integration boundaries.

## Technology Baseline

**Technology stack:** Docker Compose

### Repository Layout

- `database/` — database schema, migrations, or demonstration data
- `docs/` — architecture, operations, screenshots, and supporting documentation
- `compose.yaml` — local multi-service orchestration

## Run Locally

```bash
docker compose up -d --build
```

- Review `compose.yaml` before changing published ports, storage paths, or production credentials.

## Interface Preview

### Terminal

![Terminal](docs/images/terminal.png)

### Console

![Console](docs/images/console.png)

## Security and Production Readiness

- Never commit real passwords, API keys, tokens, certificates, customer data, or production connection strings.
- Replace all local demonstration credentials and secrets before deployment.
- Apply least privilege, tenant isolation, backup and restore drills, monitoring, rate limiting, and vulnerability management.
- Please report security issues privately through the contact channels below instead of publishing sensitive details.

## Usage and Commercial Licensing

Copyright © 2026 Shanghai Rujing Zhihua Information Technology Co., Ltd.

This project is a publicly available source edition intended solely for personal learning, technical research, and non-commercial communication. Commercial use, paid delivery, resale, hosted commercial services, and commercial derivative distribution require prior written authorization from the copyright holder.

Third-party dependencies remain subject to their respective licenses. Review the repository `LICENSE` and `NOTICE` files before use.

## Commercial Licensing and Enterprise Services

For commercial licensing, private deployment, enterprise customization, software outsourcing, implementation services, FDE outsourcing, OPC technical support, or AI transformation consulting, contact ZhuaTech:

- Email: [han@zhuatech.cn](mailto:han@zhuatech.cn)
- Email: [jack@zhuatech.cn](mailto:jack@zhuatech.cn)
- [WhatsApp: +86 17521234993](https://wa.me/8617521234993)
- Website: [https://www.zhuatech.cn/](https://www.zhuatech.cn/)

## About ZhuaTech

[ZhuaTech](https://www.zhuatech.cn/) is operated by Shanghai Rujing Zhihua Information Technology Co., Ltd. We support small and medium-sized enterprises with digital transformation, AI adoption, enterprise software implementation, custom development, software project outsourcing, FDE services, OPC integration, and long-term technical support.
