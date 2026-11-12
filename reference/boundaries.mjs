// Minimal extraction adapters; these do not authenticate a caller or query a database.
export class EmployeeProfileError extends Error { constructor(status,code,message){super(message);this.status=status;this.code=code;} }
export const fowlerComponentTypes=['ssn-trace','criminal-history','county-criminal-search','national-criminal-search','national-sex-offender-search','sex-offender-search','tennessee-foil','abuse-registry','oig-exclusions','sam-exclusions','motor-vehicle-record'];
