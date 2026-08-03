# Catalog authoring and version lifecycle

Create, populate, pack, sign, and test a data-only catalog:

```text
basic-structure catalog create ./vendor/catalog --publisher example-vendor --id product --version 1.0.0 --apply
basic-structure catalog pack ./vendor/catalog --apply
basic-structure catalog sign ./vendor/catalog --private-key ./release.pem --key-id release-2026 --apply
basic-structure catalog test ./vendor/catalog --project . --require-signature
```

The private key is read only for signing and is never copied into the bundle.
Packing rejects symbolic links. Testing performs catalog validation without
executing scripts, installing dependencies, or accessing the network.

Installed immutable versions can be switched and rolled back explicitly:

```text
basic-structure catalog switch example-vendor/product@1.1.0 --project . --plan
basic-structure catalog switch example-vendor/product@1.1.0 --project . --apply
basic-structure update --project . --plan
basic-structure catalog rollback example-vendor/product --project . --apply
```

Switching revalidates the target signature and refuses versions that remove
identities currently selected by the generated project.
