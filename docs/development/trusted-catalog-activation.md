# Trusted catalog activation

Install a signed bundle, preview activation, and activate it explicitly:

```text
basic-structure catalog add ./vendor/catalog --project . --require-signature --apply
basic-structure catalog activate example-vendor/example-catalog@1.0.0 --project . --plan
basic-structure catalog activate example-vendor/example-catalog@1.0.0 --project . --apply
basic-structure catalog active --project .
```

Project-scoped discovery includes active trusted extensions:

```text
basic-structure search vendor-feature --project .
basic-structure inspect module vendor-feature --project . --json
basic-structure recommend --capability vendor-feature --project . --json
```

Deactivate before removing an installed version:

```text
basic-structure catalog deactivate example-vendor/example-catalog@1.0.0 --project . --apply
basic-structure catalog remove example-vendor/example-catalog@1.0.0 --project . --apply
```

Activation is fail-closed. Revoking the publisher key immediately prevents the
active catalog from resolving. See the
[activation design](../specifications/trusted-catalog-activation-design.md).
