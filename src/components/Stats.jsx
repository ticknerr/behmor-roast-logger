export default function Stats({ data }) {
  const totalBeans = data.beans.length;
  const totalRoasts = data.beans.reduce((a,b)=>a+b.roasts.length,0);

  return (
    <div>
      <h3>Stats</h3>
      <p>Beans: {totalBeans}</p>
      <p>Total Roasts: {totalRoasts}</p>
    </div>
  );
}
