# PipelineNews lessons applied to GridAtlas

Source repository: https://github.com/Ventusltd/pipelinenews  
Inspected tree: `83d9c430b283f8beaa8c0a05e42b14d4a4784623`

## Adopted

- Stable source areas for UI, cartridges, manifests, state and automation.
- Timestamped scope records and compiled manifests, not timestamped copies of source modules.
- One mutable live pointer plus immutable evidence.
- One-off workflows moved to `.github/workflow-archive/` rather than left active.
- CI/CD performs deterministic compilation and gates; human and AI context is reconstructed from repository state.

## Deliberately not copied

- Workflow proliferation.
- Full application duplication for minor feature changes.
- Implicit release ordering or multiple live pointers.
