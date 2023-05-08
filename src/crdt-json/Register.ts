import { CFValue, CFValueHolder } from "./Value";

export class CFRegister implements CFValue {
  constructor(private value: unknown) {}

  getValue(): unknown {
    return this.value;
  }

  setValue(value: unknown) {
    this.value = value;
  }

  getChild(): CFValueHolder {
    throw new Error(`registers only hold primitive data`);
  }

  insertChild(): CFValueHolder {
    throw new Error(`registers only hold primitive data`);
  }

  getChildren(): Array<CFValueHolder> {
    throw new Error(`registers only hold primitive data`);
  }
}
