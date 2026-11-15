import com.bodyandiron.traininglog.PageCheck;
import java.io.File;
import java.nio.file.Files;

/** java PageCheckTest <jar> <cert.der> <shell> <current> <expect: ok:VERSION | refused:WHY> <outDir> <label> [keep] */
public class PageCheckTest {
    public static void main(String[] a) throws Exception {
        byte[] cert = Files.readAllBytes(new File(a[1]).toPath());
        String got;
        try { got = "ok:" + PageCheck.unpack(new File(a[0]), cert, Integer.parseInt(a[2]), a[3], new File(a[5])); }
        catch (PageCheck.Refused r) { got = "refused:" + r.getMessage(); }
        catch (Exception e) { got = "error:" + e; }
        boolean pass = got.equals(a[4]);
        if (pass && got.startsWith("ok:") && !new File(a[5], "index.html").isFile()) { pass = false; got += " (not unpacked)"; }
        if (!got.startsWith("ok:") && !(a.length > 7 && a[7].equals("keep")) && new File(a[5]).exists()) { pass = false; got += " (but unpacked anyway)"; }
        System.out.println((pass ? "ok   " : "FAIL ") + a[6] + " -> " + got);
        System.exit(pass ? 0 : 1);
    }
}
