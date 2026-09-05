# Student CSV Import

The operator command imports new student profiles from an Excel export saved as **CSV UTF-8 (comma delimited)**. It is create-only: existing student numbers cause the complete file to fail. It does not update existing students, create accounts or guardians, infer enrolment history, or import fees, discounts, payments or opening balances.

Use the header-only [template](../backend/resources/import-templates/students.csv). Keep student numbers as Text in Excel before exporting so leading zeroes survive. Required columns are `student_no`, `full_name`, `level_group` and `status`; optional columns are `class_name`, `gender`, `dob`, `registration_date` and `notes`. Unknown columns are rejected, including financial and guardian columns. Dates use `YYYY-MM-DD`; blank optional values remain null.

- `level_group`: `kindergarten`, `primary`, `secondary`, `stp`.
- `status`: `active`, `withdraw`, `graduate`, `inactive`.
- `class_name`: an active class in the selected school, consistent with the existing school class catalogue and level group. Blank means no current class; it does not create an academic enrolment.

From `backend/`, first validate a private file outside the repository:

```powershell
..\tools\php\php-local.cmd artisan students:import-csv --tenant=mis --school=MIS --actor=<authorized-username> --file="C:\Private\students.csv"
```

After reviewing the file and all reported row errors, use the same command with `--commit`. Without that flag, neither students nor audit events are written. The command requires an active tenant/school/user, valid tenancy configuration, school access and effective `students.create`. In dedicated mode only the configured MIS tenant is allowed. This is a trusted operator command, not a public endpoint: `--actor` records the existing authorized account responsible for the import; it does not perform an interactive password login.

The entire file is checked before insertion. Each student uses the existing mutation service and actor audit inside one transaction covering the complete import. A duplicate detected by the database or any later insert/audit failure rolls back every row in that file. Concurrent data changes can still cause the commit to fail after a successful dry run; rerun validation and resolve the source file, never disable uniqueness guards.

There is no destructive undo command. Correct a committed profile through existing authorized workflows and preserve its history. Actual MIS Excel mapping and finance/guardian onboarding require the school's source file and verified business rules; the template is not evidence that real data has been imported.
