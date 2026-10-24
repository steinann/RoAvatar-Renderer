# Tutorial on Assembly and rig traversal

## 1. What is an assembly?
All BasePart instances (that includes Part, MeshPart, UnionOperation, ...) belong to an "Assembly".

An Assembly describes the hierarchy of parts, for example HumanoidRootPart -> LowerTorso -> UpperTorso -> Head trough connections such as joints and constraints
It is used to calculate the CFrame's of the parts.

## 2. Using assembly

When .preRender is called the Assembly recalculates all of the part CFrame's
We can then extract that CFrame data with this example:

```ts
const part = ...

const partW = part.w as BasePartWrapper //wrappers are a type-safe way of implementing class specific methods

const assembly = partW.GetAssembly() //gets the main assembly
const partNode = partW.GetAssemblyNode() //gets the node inside the assembly hierarchy

const restCF = partNode.traversedRestCFrame //the precalculated rest cframe (think of it as the CFrame for when the character is in a T-pose)
const transformCF = partNode.traversedTransformCFrame //the precalculated transform cframe (the cframe of the part after animations are applied)
```

We can also travel through the hierarchy of the assembly

Here's an example of getting what a part controls and what it is controlled by
```ts
const part = ...

const partW = part.w as BasePartWrapper 
const partNode = partW.GetAssemblyNode()

//getting parent part in hierarchy
const parentNode = partNode.parent
if (parentNode) {
    const parentPart = parentNode.part
}

//getting child parts in hierarchy
for (const node of partNode.nodes) {
    const childPart = node.part
}

//getting everything in assembly
partNode.assembly.getNodeDescendants()
partNode.assembly.getPartDescendants()
```

See the documentation for more info