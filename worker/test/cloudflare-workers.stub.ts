// Stand-in for the Workers runtime module in unit tests (the real one exists only inside Workers).
export class DurableObject {
  constructor(
    protected ctx: unknown,
    protected env: unknown,
  ) {}
}
