export const SAMPLE_CODE_PYTHON = `x = 10
y = 5.5
name = "Praxly"

def check(val):
  if val > 8:
    return True
  else:
    return False

result = check(x)
print(result)
`;

export const SAMPLE_CODE_JAVA = `public class Main {
  public static void main(String[] args) {
    int x = 10;
    System.out.println(x);
  }
}
`;

export const SAMPLE_CODE_CSP = `x <- 10
DISPLAY(x)
IF (x > 5) {
  DISPLAY("Big")
}
`;

export const SAMPLE_CODE_PRAXIS = `int newScore ( int diceOne, int diceTwo, int oldScore )
  if ( diceOne == diceTwo )
    return 0
  else
    if ( ( diceOne == 6 ) or ( diceTwo == 6 ) )
      return oldScore
    else
      return oldScore + diceOne + diceTwo
    end if
  end if
end newScore`;
