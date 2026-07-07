import {
  createVacationAction,
  deleteVacationAction,
  updateVacationAction,
} from "@/app/vacations/actions";
import styles from "@/app/page.module.css";

type VacationForUi = {
  id: string;
  title: string;
  note: string | null;
  startsOn: Date;
  endsOn: Date;
};

type VacationManagementProps = {
  heading: string;
  vacations: VacationForUi[];
  returnTo: string;
  groupId?: string | null;
  traineeId?: string | null;
};

function dateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ScopeFields({ groupId, traineeId }: Pick<VacationManagementProps, "groupId" | "traineeId">) {
  return (
    <>
      {groupId && <input type="hidden" name="groupId" value={groupId} />}
      {traineeId && <input type="hidden" name="traineeId" value={traineeId} />}
    </>
  );
}

export function VacationManagement({
  heading,
  vacations,
  returnTo,
  groupId,
  traineeId,
}: VacationManagementProps) {
  return (
    <section className={styles.sectionBlock} aria-labelledby="vacation-management-title">
      <div className={styles.sectionHeader}>
        <h2 id="vacation-management-title">{heading}</h2>
        <span>{vacations.length} חופשות</span>
      </div>

      <form action={createVacationAction} className={styles.managementForm}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <ScopeFields groupId={groupId} traineeId={traineeId} />
        <label className={styles.fieldLabel}>
          שם חופשה
          <input name="title" type="text" required maxLength={160} />
        </label>
        <label className={styles.fieldLabel}>
          מתחילה
          <input name="startsOn" type="date" required defaultValue={dateInputValue()} />
        </label>
        <label className={styles.fieldLabel}>
          מסתיימת
          <input name="endsOn" type="date" required defaultValue={dateInputValue()} />
        </label>
        <label className={styles.fieldLabel}>
          הערה
          <textarea name="note" rows={3} maxLength={500} />
        </label>
        <button type="submit" className={styles.primaryButton}>
          הוספה
        </button>
      </form>

      {vacations.length > 0 ? (
        <div className={styles.vacationList}>
          {vacations.map((vacation) => (
            <div key={vacation.id} className={styles.vacationItem}>
              <form action={updateVacationAction} className={styles.managementForm}>
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="vacationId" value={vacation.id} />
                <label className={styles.fieldLabel}>
                  שם חופשה
                  <input
                    name="title"
                    type="text"
                    required
                    maxLength={160}
                    defaultValue={vacation.title}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  מתחילה
                  <input
                    name="startsOn"
                    type="date"
                    required
                    defaultValue={dateInputValue(vacation.startsOn)}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  מסתיימת
                  <input
                    name="endsOn"
                    type="date"
                    required
                    defaultValue={dateInputValue(vacation.endsOn)}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  הערה
                  <textarea
                    name="note"
                    rows={3}
                    maxLength={500}
                    defaultValue={vacation.note ?? ""}
                  />
                </label>
                <button type="submit" className={styles.primaryButton}>
                  שמירה
                </button>
              </form>
              <form action={deleteVacationAction}>
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="vacationId" value={vacation.id} />
                <button type="submit" className={styles.dangerButton}>
                  מחיקה
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.mutedText}>אין חופשות להצגה.</p>
      )}
    </section>
  );
}
